#!/usr/bin/env bash
# Does each pgTAP file's declared plan match the assertions it actually runs?
#
# A wrong plan fails the whole file even when every assertion passes, and it
# has been miscounted by hand three times. Counting is a machine's job.
set -euo pipefail

ASSERTS='^select (ok|is|isnt|is_empty|isnt_empty|throws_ok|lives_ok|results_eq|set_eq|has_table|has_column|has_extension|has_function|col_is_pk)\('
fail=0

for f in supabase/tests/*.test.sql; do
  declared=$(grep -oE 'select plan\([0-9]+\)' "$f" | grep -oE '[0-9]+')
  actual=$(grep -cE "$ASSERTS" "$f")
  if [ "$declared" != "$actual" ]; then
    echo "FAIL  $(basename "$f"): plan($declared) but $actual assertions"
    fail=1
  else
    echo "ok    $(basename "$f"): $actual assertions"
  fi
done

exit $fail
