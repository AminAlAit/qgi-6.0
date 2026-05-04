"""Beta calibration (Kull, Silva Filho, Flach 2017).

Used by Stage 1+ per-recipe heads. Fits 3 parameters (a, b, c):

    g(s)            = a*log(s) + b*log(1-s) + c
    p_calibrated(s) = sigmoid(g(s))

via maximum likelihood under L-BFGS-B with non-negativity constraints on a, b
(which ensures monotonicity in the resulting calibration function).

Beta calibration is preferred over Platt for rare-event regimes
(per qgi-docs/internal/ops/ml-track/06-modular-architecture.md):
the Beta family is the natural conjugate for probability outputs and does
not assume sigmoid linearity.

Stage 0 deliverable extension per stage-1 build.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from scipy.optimize import minimize

_EPS = 1e-12


@dataclass
class BetaCalibrator:
    """Beta-calibration parameters fitted via MLE.

    Use:
        calibrator = BetaCalibrator.fit(raw_scores, labels)
        calibrated = calibrator.predict(raw_scores)
    """
    a: float
    b: float
    c: float
    n_fit: int
    converged: bool

    @classmethod
    def fit(
        cls,
        raw_scores: np.ndarray,
        labels: np.ndarray,
        x0: tuple[float, float, float] = (1.0, 1.0, 0.0),
    ) -> "BetaCalibrator":
        s = np.clip(np.asarray(raw_scores, dtype=float), _EPS, 1 - _EPS)
        y = np.asarray(labels, dtype=int)
        if s.shape != y.shape:
            raise ValueError(f"shape mismatch: scores {s.shape} vs labels {y.shape}")
        if s.size < 2:
            # Degenerate — return identity calibrator
            return cls(a=1.0, b=1.0, c=0.0, n_fit=int(s.size), converged=False)
        log_s = np.log(s)
        log_1_s = np.log(1 - s)

        def neg_log_likelihood(params: np.ndarray) -> float:
            a, b, c = params
            g = a * log_s + b * log_1_s + c
            # log Bernoulli likelihood: y*log(sigmoid(g)) + (1-y)*log(1-sigmoid(g))
            #                         = y*g - log(1 + exp(g))
            # logaddexp(0, g) = log(1+exp(g)), numerically stable
            ll = (y * g - np.logaddexp(0.0, g)).sum()
            return -ll

        # Bounds: a, b >= 0 enforces monotonicity; c is unbounded.
        result = minimize(
            neg_log_likelihood,
            x0=np.array(x0, dtype=float),
            method="L-BFGS-B",
            bounds=[(0.0, None), (0.0, None), (None, None)],
        )
        a, b, c = float(result.x[0]), float(result.x[1]), float(result.x[2])
        return cls(a=a, b=b, c=c, n_fit=int(s.size), converged=bool(result.success))

    def predict(self, raw_scores: np.ndarray) -> np.ndarray:
        s = np.clip(np.asarray(raw_scores, dtype=float), _EPS, 1 - _EPS)
        g = self.a * np.log(s) + self.b * np.log(1 - s) + self.c
        # sigmoid(g) numerically stable
        return 1.0 / (1.0 + np.exp(-g))

    def to_dict(self) -> dict:
        return {"a": self.a, "b": self.b, "c": self.c,
                "n_fit": self.n_fit, "converged": self.converged}
