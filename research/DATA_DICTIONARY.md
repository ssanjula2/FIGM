# Research Data Dictionary — FIGM Code Inspector

## Participant Record Fields

| Field Name | Data Type | Description | Allowed Values / Range |
| :--- | :--- | :--- | :--- |
| `participant_id` | String | Anonymized unique participant identifier | `P001` - `P999` |
| `consent_given` | Boolean | Confirmation of informed consent | `true`, `false` |
| `experience_years` | Numeric | Years of frontend development experience | `0.0` - `50.0` |
| `primary_framework` | String | Primary frontend framework used | `React`, `Angular`, `Vue`, `Other` |
| `task_completed` | Boolean | Successful completion of guideline inspection task | `true`, `false` |
| `sus_1` | Integer | SUS Item 1: I think that I would like to use this system frequently | `1` (Strongly Disagree) - `5` (Strongly Agree) |
| `sus_2` | Integer | SUS Item 2: I found the system unnecessarily complex | `1` - `5` |
| `sus_3` | Integer | SUS Item 3: I thought the system was easy to use | `1` - `5` |
| `sus_4` | Integer | SUS Item 4: I think that I would need the support of a technical person | `1` - `5` |
| `sus_5` | Integer | SUS Item 5: I found the various functions in this system were well integrated | `1` - `5` |
| `sus_6` | Integer | SUS Item 6: I thought there was too much inconsistency in this system | `1` - `5` |
| `sus_7` | Integer | SUS Item 7: I would imagine that most people would learn to use this system very quickly | `1` - `5` |
| `sus_8` | Integer | SUS Item 8: I found the system very cumbersome to use | `1` - `5` |
| `sus_9` | Integer | SUS Item 9: I felt very confident using the system | `1` - `5` |
| `sus_10` | Integer | SUS Item 10: I needed to learn a lot of things before I could get going with this system | `1` - `5` |
| `timestamp` | ISO-8601 String | UTC timestamp of questionnaire submission | `YYYY-MM-DDTHH:mm:ssZ` |

## Calculated Usability Metrics

1. **System Usability Scale (SUS)**:
   $$\text{SUS Score} = 2.5 \times \left( \sum_{i \text{ odd}} (R_i - 1) + \sum_{i \text{ even}} (5 - R_i) \right)$$
2. **Cronbach's Alpha ($\alpha$)**:
   $$\alpha = \frac{K}{K-1} \left( 1 - \frac{\sum_{i=1}^K \sigma_{y_i}^2}{\sigma_x^2} \right)$$
