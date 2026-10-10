"""Walking graph over OSM ways, shortest paths with scipy."""

import numpy as np
from scipy.sparse import csr_matrix
from scipy.sparse.csgraph import dijkstra
from scipy.spatial import cKDTree

from .geo import LocalProjection, haversine
from .osm import FOOTPATHS

# cost multipliers: prefer marked trails, then footpaths, then roads
MARKED = 1.0
FOOTPATH = 1.25
ROAD = 1.6


class Graph:
    def __init__(self, osm):
        self.routes = osm.routes
        ways = osm.ways
        all_nodes = np.concatenate([w.nodes for w in ways]) if ways else np.zeros(0, np.int64)
        self.node_ids, inv = np.unique(all_nodes, return_inverse=True)
        n = len(self.node_ids)
        self.lat = np.zeros(n)
        self.lon = np.zeros(n)

        src, dst, length, cost, way_idx = [], [], [], [], []
        marked_idx = []
        pos = 0
        for wi, w in enumerate(ways):
            k = len(w.nodes)
            idx = inv[pos : pos + k]
            pos += k
            self.lat[idx] = w.lats
            self.lon[idx] = w.lons
            marked = bool(w.routes)
            if w.sac >= 5 or (w.sac == 4 and not marked):
                continue
            if marked:
                marked_idx.append(idx)
            f = MARKED if marked else FOOTPATH if w.highway in FOOTPATHS else ROAD
            seg = haversine(w.lats[:-1], w.lons[:-1], w.lats[1:], w.lons[1:])
            a, b = idx[:-1], idx[1:]
            if w.oneway >= 0:
                src.append(a), dst.append(b), length.append(seg), cost.append(seg * f), way_idx.append(np.full(k - 1, wi))
            if w.oneway <= 0:
                src.append(b), dst.append(a), length.append(seg), cost.append(seg * f), way_idx.append(np.full(k - 1, wi))

        cat = lambda xs, dt: np.concatenate(xs).astype(dt) if xs else np.zeros(0, dt)
        src, dst = cat(src, np.int64), cat(dst, np.int64)
        length, cost, way_idx = cat(length, float), cat(cost, float), cat(way_idx, np.int64)
        cost = np.maximum(cost, 0.01)  # scipy treats explicit zeros as missing edges
        # keep the cheapest edge per (src, dst) pair
        key = src * n + dst
        order = np.lexsort((cost, key))
        key, first = np.unique(key[order], return_index=True)
        sel = order[first]
        self.edge_key = key
        self.edge_len = length[sel]
        self.edge_way = way_idx[sel]
        self.n = n
        self.G = csr_matrix((cost[sel], (src[sel], dst[sel])), shape=(n, n))
        self.GT = self.G.T.tocsr()
        # same edges weighted by plain length, for routing the hand-picked trips like a plain router would
        self.GlenT = csr_matrix((np.maximum(self.edge_len, 0.01), (src[sel], dst[sel])), shape=(n, n)).T.tocsr()
        self.ways = ways

        self.proj = LocalProjection()
        xy = self.proj.xy(self.lat, self.lon)
        self.tree = cKDTree(xy) if n else None
        marked_nodes = np.zeros(n, bool)
        if marked_idx:
            marked_nodes[np.concatenate(marked_idx)] = True
        has_edge = np.zeros(n, bool)
        has_edge[src] = True
        has_edge[dst] = True
        self.marked_nodes = np.nonzero(marked_nodes & has_edge)[0]
        self.marked_tree = cKDTree(xy[self.marked_nodes]) if len(self.marked_nodes) else None
        self.routable_nodes = np.nonzero(has_edge)[0]
        self.routable_tree = cKDTree(xy[self.routable_nodes]) if len(self.routable_nodes) else None

    # ------------------------------------------------------------ snapping --
    def snap(self, lat, lon, max_m, marked_only=False):
        """Nearest routable node (optionally on a marked trail) within max_m, or None."""
        tree, ids = (self.marked_tree, self.marked_nodes) if marked_only else (self.routable_tree, self.routable_nodes)
        if tree is None:
            return None
        d, i = tree.query(self.proj.xy([lat], [lon])[0], distance_upper_bound=max_m)
        return None if not np.isfinite(d) else int(ids[i])

    # ------------------------------------------------------------- routing --
    def costs_to(self, target, limit, plain=False):
        """Cost from every node to `target`, plus a successor array to walk the path."""
        G = self.GlenT if plain else self.GT
        dist, pred = dijkstra(G, directed=True, indices=target, limit=limit, return_predecessors=True)
        return dist, pred

    def costs_from(self, source, limit):
        return dijkstra(self.G, directed=True, indices=source, limit=limit, return_predecessors=True)

    @staticmethod
    def walk_to_target(succ, start, target):
        """Path start -> target from the successor array of costs_to()."""
        path = [start]
        while path[-1] != target:
            nxt = succ[path[-1]]
            if nxt < 0:
                return None
            path.append(int(nxt))
        return path

    @staticmethod
    def walk_from_source(pred, source, end):
        path = [end]
        while path[-1] != source:
            p = pred[path[-1]]
            if p < 0:
                return None
            path.append(int(p))
        return path[::-1]

    def edges(self, path):
        """Edge indices along a node path."""
        keys = np.asarray(path[:-1], np.int64) * self.n + np.asarray(path[1:], np.int64)
        return np.searchsorted(self.edge_key, keys)

    def has_oneway(self, path):
        return any(self.ways[w].oneway != 0 for w in self.edge_way[self.edges(path)]) if len(path) > 1 else False

