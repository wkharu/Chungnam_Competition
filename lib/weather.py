# -*- coding: utf-8 -*-
"""
기상청 단기예보 API 연동
docs: https://www.data.go.kr/data/15084084/openapi.do
"""
import math
import re
import requests
from datetime import datetime, timedelta

from lib.airquality import air_quality_for_city
from lib.config import settings

# 충남 주요 지역 격자 좌표 (위경도 → X/Y 격자)
GRID_COORDS = {
    "아산": {"nx": 67, "ny": 100},
    # 천안은 동쪽으로 격자가 달라짐(아산과 동일하면 예보가 똑같이 나옴)
    "천안": {"nx": 63, "ny": 110},
    "공주": {"nx": 63, "ny": 96},
    "보령": {"nx": 54, "ny": 91},
    "서산": {"nx": 51, "ny": 103},
    "논산": {"nx": 62, "ny": 92},
    "계룡": {"nx": 65, "ny": 95},
    "당진": {"nx": 54, "ny": 105},
    "태안": {"nx": 48, "ny": 100},
    "홍성": {"nx": 55, "ny": 98},
    "부여": {"nx": 60, "ny": 91},
    "금산": {"nx": 69, "ny": 88},
    "서천": {"nx": 55, "ny": 87},
    "예산": {"nx": 58, "ny": 99},
    "청양": {"nx": 59, "ny": 94},
}


def _forecast_from_items(items: list, now_hour: int) -> tuple[dict[str, str], str | None]:
    """
    단기예보 item 목록에서 현재 시각에 가장 가까운 fcstTime 슬롯의 category→값 맵 생성.
    정확히 현재 시각만 고르면, API가 내준 fcstTime이 한 시간씩 건너뛰는 경우 TMP 등이 비어 20도 기본값이 된다.
    """
    by_time: dict[str, dict[str, str]] = {}
    for item in items:
        ft = item.get("fcstTime")
        cat = item.get("category")
        if not ft or not cat:
            continue
        by_time.setdefault(ft, {})[cat] = item.get("fcstValue", "")

    if not by_time:
        return {}, None

    # 현재 시각(시)을 4자리 정수와 비교: 14시 → 1400
    target = now_hour * 100

    def time_key(ft: str) -> int:
        try:
            return int(ft)
        except (TypeError, ValueError):
            return 0

    # 가장 가까운 발표 슬롯(절대 차 최소)
    best_ft = min(by_time.keys(), key=lambda ft: abs(time_key(ft) - target))
    return by_time.get(best_ft, {}), best_ft


def get_base_time() -> tuple[str, str]:
    """기상청 API 기준 시각 계산 (30분 단위 발표)"""
    now = datetime.now()
    # 발표 시각: 0200, 0500, 0800, 1100, 1400, 1700, 2000, 2300
    base_hours = [2, 5, 8, 11, 14, 17, 20, 23]

    # 현재 시각보다 이전인 가장 최근 발표 시각 선택
    hour = now.hour
    base_hour = max([h for h in base_hours if h <= hour], default=23)

    if base_hour > hour:  # 자정 이후 케이스
        now -= timedelta(days=1)
        base_hour = 23

    base_date = now.strftime("%Y%m%d")
    base_time = f"{base_hour:02d}00"
    return base_date, base_time


def _sanitize_fallback_note(reason: str) -> str:
    """
    예외 문자열에 포함된 전체 URL·serviceKey가 UI에 노출되지 않도록 정리.
    (requests HTTPError는 'for url: ...serviceKey=...' 형태로 키가 들어감)
    """
    if not reason:
        return ""
    r = reason.strip()
    if re.search(r"\b403\b", r) or "Forbidden" in r:
        return (
            "공공데이터포털(data.go.kr)에서 「기상청_단기예보」 "
            "(VilageFcstInfoService) 활용신청이 승인됐는지 확인하고, "
            "호출 IP 제한을 켠 경우 현재 접속 IP를 등록했는지 확인하세요."
        )
    low = r.lower()
    if "for url:" in low:
        head = r[: low.index("for url:")].strip()
        return f"{head} (요청 URL·인증키는 보안상 생략)"
    r = re.sub(r"serviceKey=[^&\s]+", "serviceKey=***", r, flags=re.IGNORECASE)
    r = re.sub(r"https?://[^\s]+", "[URL 생략]", r)
    return r[:400]


def _apply_air_quality(out: dict, city: str) -> dict:
    """에어코리아 연동(실패 시 out의 dust 등 유지)."""
    air = air_quality_for_city(city)
    if air:
        out["dust"] = air["dust"]
        out["pm25"] = air.get("pm25")
        out["pm10"] = air.get("pm10")
        out["air_source"] = (
            f"에어코리아 {air.get('sido_name')} "
            f"측정소 {air.get('stations_used')}개 기준 "
            f"({air.get('grade_basis')})"
        )
    return out


def _fallback_weather(city: str, reason: str) -> dict:
    """기상청 실패·키 없음 시에도 추천 API가 돌아가도록 하는 보수적 기본값."""
    now = datetime.now()
    out: dict = {
        "temp":        20.0,
        "precip_prob": 0.0,
        "sky":         1,
        "hour":        now.hour,
        "city":        city,
        "base_date":   now.strftime("%Y%m%d"),
        "base_time":   "0500",
        "fcst_time_slot": None,
        "dust":        1,
        "pm25":        None,
        "pm10":        None,
        "air_source":  None,
        "weather_fallback": True,
        "weather_fallback_note": _sanitize_fallback_note(reason),
        "weather_source": "fallback",
    }
    return _apply_air_quality(out, city)


def fetch_weather(city: str = "아산") -> dict:
    """
    기상청 단기예보 API 호출
    반환: scoring.py에서 사용할 형식
    API 실패 시 에어코리아만 반영한 폴백 값(weather_fallback=True).
    """
    if city not in GRID_COORDS:
        raise ValueError(f"지원하지 않는 도시: {city}. 지원 목록: {list(GRID_COORDS.keys())}")

    if not settings.weather_api_key:
        return _fallback_weather(city, "WEATHER_API_KEY가 설정되지 않았습니다.")

    coords = GRID_COORDS[city]
    base_date, base_time = get_base_time()
    now_hour = datetime.now().hour

    params = {
        "serviceKey": settings.weather_api_key,
        "numOfRows":  100,
        "pageNo":     1,
        "dataType":   "JSON",
        "base_date":  base_date,
        "base_time":  base_time,
        "nx":         coords["nx"],
        "ny":         coords["ny"],
    }

    try:
        response = requests.get(settings.weather_forecast_url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()
        body = data.get("response", {}).get("body", {})
        raw_items = body.get("items")
        if raw_items is None:
            items = []
        elif isinstance(raw_items, dict):
            it = raw_items.get("item")
            items = it if isinstance(it, list) else ([it] if it else [])
        else:
            items = raw_items

        header = data.get("response", {}).get("header", {})
        rc = str(header.get("resultCode", "00")).strip()
        if rc not in ("00", "0"):
            return _fallback_weather(
                city,
                f"기상청 API 오류: {header.get('resultMsg', header)}",
            )

        forecast, fcst_slot = _forecast_from_items(items, now_hour)

        def _num(cat: str, default: float) -> float:
            raw = forecast.get(cat)
            if raw in (None, ""):
                return default
            try:
                return float(raw)
            except (TypeError, ValueError):
                return default

        out: dict = {
            "temp":        _num("TMP", 20.0),
            "precip_prob": _num("POP", 0.0),
            "sky":         int(_num("SKY", 1.0)),
            "hour":        now_hour,
            "city":        city,
            "base_date":   base_date,
            "base_time":   base_time,
            "fcst_time_slot": fcst_slot,
            "dust":        1,
            "pm25":        None,
            "pm10":        None,
            "air_source":  None,
            "weather_fallback": False,
            "weather_source": "vilagefcst",
        }
        return _apply_air_quality(out, city)
    except Exception as e:
        return _fallback_weather(city, f"{type(e).__name__}: {e}")


if __name__ == "__main__":
    import io, sys
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

    print("기상청 API 테스트")
    result = fetch_weather("아산")
    print(result)
