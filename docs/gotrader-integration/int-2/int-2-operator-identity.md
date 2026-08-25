# INT-2 Operator Identity

The canonical cycle fingerprint and Activate Market summary fingerprint use
the same source identity. Live tape drift does not invalidate an already bound
cycle. A genuine cycle or canonical-source mismatch still fails closed.

Quota failure preserves the current operator-cycle and Activate Market summary
in memory. The plan remains cycle-bound and no heartbeat write can terminate
the cycle solely because origin storage is full.
