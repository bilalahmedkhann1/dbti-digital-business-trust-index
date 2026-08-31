## Logo verification

The desktop preview after wiring `/manus-storage/dbti-logo-transparent_4289e14b.png` shows a small light/white square around a tiny DBTI mark rather than a clean readable transparent wordmark. The implementation should not be checkpointed in this state. The next correction should use a deterministic transparent crop/recolor treatment or revert to the previously verified cropped asset while removing only the CSS white navbar surface.

The prior verified asset `/manus-storage/dbti-logo-cropped_1470a17a.png` was readable on a white contrast surface; it is not suitable alone on the dark header because the wordmark is dark.

## Final verification

The final `dbti-logo-light_d3f5013b.png` renders as a readable white DBTI wordmark with a blue dot on the dark header and no white background. Desktop and 375px mobile screenshots both show correct navbar alignment and readable logo sizing.
