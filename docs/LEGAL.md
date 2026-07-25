# ClearLane legal posture

Plain language. This is how the product stays on the right side of the lines that matter for
auto insurance distribution. It is written to be read by a judge, a lawyer, or a new engineer.

## 1. Filed rates, we do not negotiate price

Auto insurance rates are filed with state regulators. A customer service rep who offers a
discount off a filed rate is committing rebating, which is illegal. So the phone agent never
tries to talk a price down. What it does instead is legal and valuable:

- reach carriers and brokers that have no online quote form
- qualify and stack discounts the driver is entitled to (paperless, pay in full, telematics)
- restructure coverage, including the Michigan PIP medical tier choice
- add endorsements, specifically the rideshare or delivery endorsement

Access and structuring, not haggling.

## 2. Recording consent

Every call opens with this line, spoken first, before anything else. Copied verbatim from
`src/lib/voice/script.ts`:

> Hi, this is an automated assistant calling on behalf of Marcus Boswell to get an auto
> insurance quote. This call is recorded for quality and accuracy. Is it okay to continue?

Michigan is a one-party consent state, so recording is legal without the other party's
consent. We disclose regardless of state, because it is good practice and because several
states require all-party consent.

## 3. Data boundaries, enforced in code

The agent gathers enough to obtain a quote and never enough to bind a policy. There is a hard
denylist enforced in code, not just asked for in the prompt, in `src/lib/voice/denylist.ts`.
It runs on generated speech before text to speech (`assertSafeSpeech`) and on tool inputs
(`assertSafeToolInput`). It blocks three categories:

- Social Security numbers
- driver license numbers
- payment information (card number, CVV, bank account, routing number)

It is covered by tests in `src/lib/voice/denylist.test.ts`, including a test that it does not
trip on the fields a quote legitimately needs (VIN, ZIP, phone, date of birth, premiums).

## 4. Indicative, not bindable

A quote reference number proves an indicative quote exists. It is not a bound price. The final
number can change after a motor vehicle record, a C.L.U.E. claims history pull, and a credit
check. The emailed report states this on every option, verified and simulated alike, in
`src/lib/report/email.ts`.

## Licensing posture

ClearLane is research plus agent-assist plus lead generation, with a hand-off to a licensed
producer to actually bind. We do not solicit, negotiate, or bind insurance for compensation
ourselves. Capturing commission at scale would require being or controlling a licensed agency
with carrier appointments, which is the path, not the current state.
