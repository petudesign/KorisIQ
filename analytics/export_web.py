"""Export compact season summaries without player records to the frontend."""
import json
import sys
from pathlib import Path


def export_summary(path: Path) -> None:
    data = json.loads(path.read_text(encoding="utf-8"))
    output = path.with_suffix(".summary.json")
    temporary = output.with_suffix(".tmp")
    temporary.write_text(json.dumps({key: data[key] for key in ("summary", "aggregate")}, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary.replace(output)


if __name__ == "__main__":
    export_summary(Path(sys.argv[1]))
