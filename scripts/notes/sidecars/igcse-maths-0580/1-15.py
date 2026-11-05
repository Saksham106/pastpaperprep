"""SymPy-free assertions for 0580 lesson 1.15 (time). Not shipped to the browser.

The `time` verify kind reads 24-hour clock times and durations only. Three kinds of answer in this lesson need more:
  - 12-hour clock times such as `12.25\\text{ a.m.}` (the `time` kind refuses a.m./p.m. on purpose);
  - a day and a time, such as `\\text{Sunday } 04\\,55`, for journeys that cross midnight;
  - an age difference in years and months, such as `5 years 5 months`.
Each reader takes the published right-hand side (after the last `=`) and compares it with the truth worked out here
from the question's own numbers. A value that reads but is wrong raises AssertionError; text that cannot be read
raises ValueError. Everything else in the lesson uses its declarative `verify` block.
"""
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]


def _plain(tex):
    text = str(tex).replace("$", " ")
    text = re.sub(r"\\(?:text|mathrm|textrm)\{([^{}]*)\}", r" \1 ", text)
    text = re.sub(r"\\[,;:! ]|\\quad|\\qquad", " ", text)
    text = text.replace("{", " ").replace("}", " ")
    text = re.sub(r"\s+", " ", text).strip()
    return re.split(r"=", text)[-1].strip().lower()


def clock12(tex, minutes):
    """A 12-hour time h.mm a.m. / p.m. equal to `minutes` after midnight (mod one day)."""
    rhs = _plain(tex)
    match = re.fullmatch(r"(\d{1,2})[.:](\d{2})\s*([ap])\.?\s*m\.?", rhs)
    if not match:
        raise ValueError(f"no 12-hour time such as 4.05 p.m. in {tex!r} (read {rhs!r})")
    hours, mins, half = int(match.group(1)), int(match.group(2)), match.group(3)
    if not 1 <= hours <= 12 or mins > 59:
        raise AssertionError(f"{tex!r} is not a real 12-hour time")
    value = (hours % 12 + (12 if half == "p" else 0)) * 60 + mins
    if value != minutes % 1440:
        raise AssertionError(f"{tex!r} is {value // 60:02d}:{value % 60:02d}, not {minutes % 1440 // 60:02d}:{minutes % 60:02d}")


def day_time(tex, start_day, minutes):
    """A day and a 24-hour time, `minutes` after 00 00 on `start_day`."""
    rhs = _plain(tex).replace(",", " ")
    match = re.fullmatch(r"([a-z]+)\s+(\d{2})\s*:?\s*(\d{2})", rhs)
    if not match or match.group(1) not in DAYS:
        raise ValueError(f"no day and 24-hour time such as Sunday 04 55 in {tex!r} (read {rhs!r})")
    hours, mins = int(match.group(2)), int(match.group(3))
    if hours > 23 or mins > 59:
        raise AssertionError(f"{tex!r} is not a real time of day")
    expected_day = DAYS[(DAYS.index(start_day) + minutes // 1440) % 7]
    if match.group(1) != expected_day:
        raise AssertionError(f"{tex!r}: the day is {expected_day}")
    if hours * 60 + mins != minutes % 1440:
        raise AssertionError(f"{tex!r} is not {minutes % 1440 // 60:02d} {minutes % 60:02d}")


def years_months(tex, months):
    """An amount written as `a years b months`, with b under 12, equal to `months`."""
    rhs = _plain(tex)
    match = re.fullmatch(r"(\d+)\s*years?\s*(\d+)\s*months?", rhs)
    if not match:
        raise ValueError(f"no 'years and months' in {tex!r} (read {rhs!r})")
    years, extra = int(match.group(1)), int(match.group(2))
    if extra > 11:
        raise AssertionError(f"{tex!r}: months must be under 12 once years are written")
    if years * 12 + extra != months:
        raise AssertionError(f"{tex!r} is {years * 12 + extra} months, not {months}")


CHECKS = {
    # 00 25 in the 12-hour clock.
    "ex-midnight-12-hour": lambda tex: clock12(tex, 0 * 60 + 25),
    # 14 15 in the 12-hour clock.
    "check-to-12-hour": lambda tex: clock12(tex, 14 * 60 + 15),
    # Ages 15 y 4 m and 9 y 11 m: the difference.
    "check-age-difference": lambda tex: years_months(tex, (15 * 12 + 4) - (9 * 12 + 11)),
    # Leaves 21 38 on Monday, flight 4 h 55 min.
    "ex-overnight-arrival": lambda tex: day_time(tex, "monday", 21 * 60 + 38 + 4 * 60 + 55),
    # Leaves Dubai 14 20 Saturday, 9 h 35 min, Tokyo 5 h ahead.
    "ex-time-zone-flight": lambda tex: day_time(tex, "saturday", 14 * 60 + 20 + 9 * 60 + 35 + 5 * 60),
}
NUMERIC = {}


def verify(id, value, tolerance=None):
    if id not in CHECKS:
        raise KeyError(f"no assertion for {id}")
    CHECKS[id](value) if tolerance is None else CHECKS[id](value, tolerance)
