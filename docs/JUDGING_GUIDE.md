# Judging: how assignment, scoring and results work

## Who does what
| Person | Where | What they can do |
|---|---|---|
| Administrator / Coordinator | **Admin → Judging** | Assign applications, follow progress, resolve conflicts, see results, reopen a submitted score sheet |
| Reviewer (screening round) | `/review` | See and score **only** applications assigned to them |
| Judge (later rounds) | `/judge` | Same as reviewers, for the judging round |

Judges and reviewers are separate pools. A reviewer never sees judges' work, and the reverse.

## 1. Add the people
Go to **Admin → Staff → Add person**, choose the role **Reviewer** or **Judge**, and send them the invite link.

## 2. Assign applications
Go to **Admin → Judging**. Pick the round, either **Screening (reviewers)** or **Judges**, then:
1. Set **how many people per application** (your choice, for example 2).
2. Choose which applications to include:
   - by status (the defaults are Submitted and Under review for reviewers, and Shortlisted and Finalist for judges)
   - optionally, one value chain or one state
3. Press **Preview**. You see how many assignments will be made and how many each person will end up with.
4. Press **Confirm and assign**. The people see the applications straight away.

**The rules the system follows:**
- Work is shared evenly: the person with the fewest applications gets the next one.
- Nobody gets the same application twice.
- Nobody gets an application sent from their own email address.
- Nobody gets an application they declared a conflict on.
- Running it again only **fills gaps**, so it's safe to repeat after adding people or after a conflict.

To give one application to one specific person, open the application. In **Panel reviews**, choose the person and press **Assign**. From the same place you can **Withdraw** an unfinished assignment.

## 3. Scoring (what judges and reviewers see)
**My applications** lists only their own assignments.
- **Status tabs:** To score, In progress, Submitted and Conflicts, each with a count.
- **Filters:** value chain, state, business stage, rural or urban, plus search by reference or business name.
- **Sort:** oldest assigned, reference, business name, or my score.

Filters stay in the page address, so they survive opening an application and coming back.

**The score sheet** opens when they click an application. The application is on the left and the score sheet is on the right:
- 1 to 10 for each criterion. The band meaning (Exceptional, Strong and so on) appears under the choice.
- An optional note on each criterion.
- An **overall comment**, which is required (at least 20 characters).
- A tick confirming they have no conflict of interest.
- The weighted total out of 100 updates live.
- **Save draft** keeps their work so they can finish later.
- **Submit scores** locks the sheet. Only an administrator can reopen it.
- **Previous** and **Next** move between their assigned applications.

**What panel members never see:**
- the applicant's phone, WhatsApp, email, home address, date of birth or disability details
- other people's scores
- any lists or totals

They do see the applicant's name and business, because they need those to recognise a conflict.

**Conflict of interest:** the panel member presses **Declare a conflict of interest instead** and says briefly what the relationship is. They never score that application. It then appears in red on **Admin → Judging** with a **Give to someone else** button.

## 4. Results
The **Results** section on **Admin → Judging** shows, for each application:
- its rank
- submitted sheets out of assigned
- the average of submitted totals only (a missing score is never counted as zero)
- the average for each criterion
- the lowest and highest total

It also flags applications:
- **Tie**: same average and same tie-break scores. Ties are ordered by originality, then scalability, then feasibility; anything still tied goes to the moderation panel.
- **Scores far apart**: totals 20 or more points apart. That threshold is a working setting, not a programme rule.
- **Waiting**: someone hasn't submitted yet.
- **Nobody assigned**: everyone on it declared a conflict or was withdrawn.

**Download CSV** exports the table. Status changes, such as Shortlisted, are still made by a person on the application page. Scores never change an application's status automatically.

## 5. The AI assistant
Judges and reviewers can ask about:
- the rubric and what the score bands mean
- how to use the score sheet
- conflicts of interest
- whether they can change a submitted score
- tie-breaks
- the difference between judges and reviewers

The assistant **cannot see any application and never suggests scores**, because scoring must be the person's own judgement. It refuses questions about applicant figures.

Administrators can also ask it "How do I assign applications?" and "Where are the rankings?".

## Where the data lives
In the **Panel Reviews** tab of the Google Sheet, one row per application and person:
- the status
- the five scores
- the total
- the comments
- any conflict note
- the times it was assigned, updated and submitted

Every assignment, submission, conflict, withdrawal and reopening is also written to **Application Events**. Create the tab with `npm run setup:sheets`, which only adds what is missing.
