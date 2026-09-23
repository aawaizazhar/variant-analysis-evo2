# Frontend test cases

| Test Case ID | Scenario | Input / condition | Expected result | Current automation |
|---|---|---|---|---|
| TC-001 | User registration | Valid email and password | Account is created and user can access app | Manual/E2E recommended. Requires Supabase auth test project or mocked browser flow. |
| TC-002 | Login and profile | Valid credentials and profile update | Login succeeds and profile changes are saved | Manual/E2E recommended. Plan helper behavior is covered in `src/lib/plans.test.ts`. |
| TC-003 | Unauthorized access | API request without session | API returns Unauthorized | Automated in `src/app/api/variant-analysis/route.test.ts` and `src/app/api/export/predictions/route-api.test.ts`. |
| TC-004 | Gene search | Gene: BRCA1 or TP53, assembly hg38 | Gene metadata and coordinates display | Manual/E2E recommended. Add Playwright or React Testing Library tests around gene search UI/API mocks. |
| TC-005 | DNA sequence viewer | Select valid gene region | Reference sequence and position numbers display | Manual/E2E recommended. Add component tests for `GeneSequence`. |
| TC-006 | Valid SNV simulation | Position, ref A/C/G/T, alt different base | Mutation summary is prepared for analysis | Automated in `src/lib/snv-pipeline.test.ts` via `normalizeVariantInput`. UI validation can be added with component tests. |
| TC-007 | Invalid SNV input | Same ref/alt, invalid base, missing position | Clear validation error is displayed | Automated in `src/lib/snv-pipeline.test.ts` for validation logic; API invalid JSON covered in `src/app/api/variant-analysis/route.test.ts`. |
| TC-008 | Evo2 prediction | Valid SNV analysis request | Pathogenicity classification and score displayed | Automated in `src/lib/snv-pipeline.test.ts` and `src/lib/snv-pipeline-cache.test.ts` for prediction normalization/cache flow. UI display tests recommended. |
| TC-009 | ClinVar comparison | Known ClinVar variant | Clinical significance and review status displayed | Partially automated in `src/lib/snv-pipeline.test.ts` for final interpretation. Add mocked Supabase ClinVar lookup integration tests for full coverage. |
| TC-010 | Disease ranking | HBB rs334 candidate | Sickle cell disease appears as expected association | Partially automated in `src/lib/snv-pipeline.test.ts` for high disease-score interpretation. Backend positive control covers live HBB rs334 ranking. |
| TC-011 | Results dashboard | Completed analysis | Evo2, ClinVar, disease ranking, warning, and disclaimer shown | Disclaimer/final interpretation automated in `src/lib/snv-pipeline.test.ts`; UI dashboard test recommended. |
| TC-012 | Prediction history | Completed authenticated analysis | Record saved in prediction history | Partially covered by pipeline persistence code path; add API integration test with mocked `persistAnalysisHistory`. |
| TC-013 | CSV export | Researcher and student accounts | Researcher can export; student sees restriction | Automated in `src/app/api/export/predictions/route.test.ts` and `src/app/api/export/predictions/route-api.test.ts`. |
| TC-014 | External API failure | Simulated API timeout/unavailable response | System shows handled error and does not crash | Automated in `src/lib/snv-pipeline-cache.test.ts` for missing Evo2 service and cache warning handling. Add fetch timeout/server-error tests for more coverage. |

## Commands

Run all frontend tests:

```sh
cd evo2-frontend
npm test
```

Store results:

```sh
npm test > test-results.txt 2>&1
```

Run coverage:

```sh
npm run test:coverage > test-coverage-results.txt 2>&1
```
