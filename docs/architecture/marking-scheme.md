# Configurable marking schemes

The question-paper layout is administrator-managed domain data. Changing a paper must not require changing or redeploying software.

Each marking scheme will be tenant-scoped and versioned. Its items identify a question, optional subquestion, part/group, display order, and maximum mark. A paper version selects exactly one published scheme version. Once marks reference a published version, that version is immutable; corrections create a successor version so historical calculations remain reproducible.

## Sample configuration

Every scheme version records the exact immutable question-paper version that supplies its
questions and parts. Draft creation and publication validate complete question coverage,
question/part ownership, group membership, parent-child totals, the derived paper total,
and administrator-defined confidence thresholds.

| Questions       | Maximum per question | Group maximum |
| --------------- | -------------------: | ------------: |
| Q1–Q10          |                    2 |            20 |
| Q11–Q15         |                   13 |            65 |
| Q16             |                   15 |            15 |
| **Paper total** |                      |       **100** |

Q11–Q16 may have any number of parts. The administrator assigns maximum marks to those parts, and validation ensures their configured aggregate agrees with the parent question maximum. The engine reads this configuration to validate individual marks and calculate totals; it never infers limits from question numbers.
