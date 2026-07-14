# ecad-viewer refactor baseline

The Prism host adapter is rebased on upstream ecad-viewer commit
`a6456d3e9f10cdf761ce0c0e711ac69251e1fa45`.

Reference projects used for the post-reset performance comparison:

- JTYU-OBC: `8f71cfea2b2cac8719f709fa09d2cd5c93449839`
- USB-PD-Trigger-Board: `3ec8f9cc79c874c433551f96889fce49c4eaac94`

The pre-refactor Prism bundle came from the local ecad-viewer fork at
`7b442967613115e47ac7c9d492edd3d506ea2794`. The generated build manifest
records the upstream base, adapter commit, and SHA-256 for both browser
artifacts. Runtime performance measurements are recorded only against the
project commits above so later source changes do not invalidate the comparison.
