# I1 Opening Gap Specification

`canonicalOpeningGap` owns NDOG and NWOG identity while preserving the existing prior-close/new-open arithmetic. Facts record prices, bounds, midpoint, boundary candle IDs, market date/week identity, calendar policy, and time authority.

Calendar time is normalized through the accepted New York IANA resolver. Weekend gaps use prior observed close to next observed open. Holiday and early-close classification requires an accepted source calendar; maintenance adjacency alone is not asserted to be a calendar gap. Those calendar enrichments remain documented compatibility limitations rather than invented schedules.

No NDOG or NWOG trading model is implemented.
