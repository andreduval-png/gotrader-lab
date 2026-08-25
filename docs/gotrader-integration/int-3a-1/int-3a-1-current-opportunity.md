# INT-3A.1 Current Opportunity

Current Opportunity now exposes `canonicalCandidates`, candidate-set counts and
disposition, the selected candidate ID when exactly one exists, and the global
canonical conflict.

All independently produced opportunities are assembled before the unified set
is evaluated. IFVG v3 preserves its producer candidate, strategy, profile,
context, and geometry identities. ICT 2022, PO3, and Judas preserve their own
producer identities and states.

`topOpportunity` is presentation-safe: it is the sole selected canonical
candidate only when one actionable candidate exists. It is unset for aligned
multi-candidate and conflicting sets. Near-miss and rejected presentation rows
remain available without becoming authoritative trade selectors.

