# Frontend test matrix

| Feature ID | Feature name | Test type | Test design reference | Current frontend coverage |
|---|---|---|---|---|
| F-01 | User Registration, Login, Profile, and Plan Access | Black Box / Grey Box | TDS-01 | `src/lib/plans.test.ts` verifies plan normalization, feature gates, and genome access limits used after profile lookup. |
| F-02 | Gene Search and Genome Assembly Selection | Black Box | TDS-02 | `src/lib/plans.test.ts` and `src/lib/snv-pipeline.test.ts` verify assembly normalization and plan-based assembly allowance. UI gene search tests should be added with React Testing Library/Playwright. |
| F-03 | Reference DNA Sequence Viewing | Black Box | TDS-02 | Not yet automated at UI level. Recommended next test: render `GeneSequence` and assert displayed bases/range controls. |
| F-04 | SNV Simulation and Input Validation | White Box / Black Box | TDS-03 | `src/lib/snv-pipeline.test.ts` validates SNV input type guards, normalization, invalid bases, same ref/alt, invalid positions, and chromosome requirements. |
| F-05 | Evo2 Pathogenicity Prediction | Grey Box / White Box | TDS-04 | `src/lib/snv-pipeline.test.ts` covers prediction label normalization and final interpretation. `src/lib/snv-pipeline-cache.test.ts` covers cached and live Evo2 result handling. |
| F-06 | ClinVar Clinical Comparison | Grey Box | TDS-05 | `src/lib/snv-pipeline.test.ts` covers exact ClinVar/VUS interpretation behavior. More integration tests can mock Supabase ClinVar lookup. |
| F-07 | Custom Disease Association Ranking | White Box / Grey Box | TDS-05 | `src/lib/snv-pipeline.test.ts` covers final interpretation when top ML disease score is high. More tests can mock disease ranking service responses. |
| F-08 | Unified Results Dashboard and Disclaimer | Black Box | TDS-06 | `src/lib/snv-pipeline.test.ts` verifies all final interpretation outputs include the research disclaimer. UI dashboard rendering tests are next. |
| F-09 | Prediction History and CSV Export | Grey Box | TDS-06 | `src/app/api/export/predictions/route.test.ts` verifies enriched CSV export, escaping, and dataset quality flags. |
| F-10 | Caching, Logging, and Error Handling | White Box / Grey Box | TDS-07 | `src/lib/snv-pipeline-cache.test.ts` covers Evo2 cache hit/miss, cache warning propagation, cache write, and missing service configuration errors. |

## Run commands

Install test dependencies first if they are not already installed:

```sh
npm --prefix evo2-frontend install
```

Then run:

```sh
npm --prefix evo2-frontend test
npm --prefix evo2-frontend run test:coverage
```
