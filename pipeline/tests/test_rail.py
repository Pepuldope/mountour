"""Trains for "real connections by train"."""

import datetime as dt
import io
import json
import zipfile

from pipeline import rail

FILES = {
    "agency.txt": "agency_id,agency_name,agency_url,agency_timezone\n0,\"Železničná spoločnosť Slovensko, a.s.\",https://x,Europe/Bratislava\n",
    "routes.txt": "route_id,agency_id,route_short_name,route_long_name,route_type\n1,0,R 601,Kriváň,2\n2,0,Os 3409,,2\n",
    "calendar.txt": "service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\n"
    "1,1,1,1,1,1,1,1,20261001,20261212\n2,1,1,1,1,1,0,0,20261001,20261212\n",
    "calendar_dates.txt": "service_id,date,exception_type\n1,20261014,2\n2,20261017,1\n",
    "trips.txt": "trip_id,route_id,service_id\n10,1,1\n20,2,2\n",
    "stops.txt": "stop_id,stop_name,stop_lat,stop_lon\nA,Bratislava hl.st.,48.158,17.106\nB,Žilina,49.226,18.743\nC,Strečno,49.176,18.86\nD,Varín,49.2,18.87\n",
    "stop_times.txt": "trip_id,arrival_time,departure_time,stop_id,stop_sequence,pickup_type,drop_off_type\n"
    "10,06:55:00,06:55:00,A,1,,\n10,09:07:00,09:07:00,B,2,,\n"
    "20,09:16:00,09:16:00,B,1,,\n20,09:22:00,09:22:00,D,2,1,1\n20,09:27:00,09:27:00,C,3,,\n20,24:05:00,24:05:00,C,4,,\n",
}


def gtfs():
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        for name, text in FILES.items():
            z.writestr(name, text)
    buf.seek(0)
    return zipfile.ZipFile(buf)


def test_build_days_services_and_stops(tmp_path):
    data = rail.build(gtfs(), dt.date(2026, 10, 13), 5)  # Tue 13 .. Sat 17 Oct
    assert data["days"] == ["20261013", "20261014", "20261015", "20261016", "20261017"]
    assert data["agencies"] == ["ZSSK"]
    by_label = {t[0]: t for t in data["trips"]}
    assert data["services"][by_label["R 601"][3]] == "10111"  # cancelled on the 14th
    assert data["services"][by_label["Os 3409"][3]] == "11111"  # added on Saturday the 17th
    os_stops = by_label["Os 3409"][4]
    names = [data["stations"][i][0] for i in os_stops[0::3]]
    assert names == ["Žilina", "Strečno", "Strečno"]  # Varín passed through
    assert os_stops[-1] == 24 * 60 + 5
    path = rail.write(tmp_path, data)
    assert json.loads(path.read_text())["trips"] == data["trips"]


def test_days_stop_at_the_end_of_the_feed():
    # The calendar ends on 12 Dec (the timetable change): later days aren't "no trains", they're unknown.
    data = rail.build(gtfs(), dt.date(2026, 12, 10), 5)
    assert data["days"] == ["20261210", "20261211", "20261212"]
