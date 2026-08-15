# Personas

Four roles. One account model — a person can be a farmer in April and a captain in June, and the app must never force a permanent choice.

---

## 1. Gurmeet Singh — the farmer

**42, village near Jalalabad, 9 killa. Cotton–wheat rotation.**

Owns a 50 HP tractor and a cultivator. For anything bigger he hires. Uses a ₹9,000 Android phone, mostly for WhatsApp and YouTube. Reads Gurmukhi slowly; will not read a paragraph of English. Types by voice.

**His week in mid-April:** the wheat is ready. It has to come off in the next six days or it shatters and he loses yield. He has called two combine owners. One says "kal aaunga" and doesn't come. The other wants ₹1,400 per killa, which is ₹200 above what his neighbour paid yesterday, and won't come for less than 5 killa.

**What he needs:** to know *today* which machines exist near him, what they charge, and when they can actually arrive.

**What he distrusts:** an area number he didn't agree to. A price that changes when the machine shows up. Anything that asks for his bank details.

**What would make him tell his brother about the app:** a machine arriving on the day it said it would.

> *"Rate pehle bata do. Baad mein mat badalna."*

---

## 2. Jaspal — the captain

**35, owns a combine harvester and a tractor with a straw reaper.**

The combine cost ₹28 lakh, financed. It earns for about six weeks a year and must earn enough in those six weeks to cover the whole year's EMI. He is not a farmer — machinery is his business.

**His problem is idle hours, not lack of work.** In peak week he turns down jobs; the loss is the two hours between fields, the half-day when a farmer isn't ready, the small plots he skips because repositioning costs more than the job pays. A commission agent finds him work and takes a cut.

**What he needs:** a full queue, geographically sensible, planned a day ahead. Jobs clustered so he isn't crossing the district twice.

**What he distrusts:** anything that looks like it will take a commission. Anything that makes him wait for payment.

**What makes him keep the app:** it fills tomorrow's schedule tonight.

> *"Mainu kamm chahida, roz. Khali khadi machine sabse mehngi hai."*

---

## 3. Balwinder — the farmer-lender

**56, 14 killa near Abohar. Kinnow orchard plus wheat.**

Owns a tractor, rotavator, disc harrow, MB plough, and an orchard sprayer. Most sit idle most of the year. Neighbours borrow them informally — sometimes for money, usually as a favour, occasionally returned damaged with no conversation about it.

He is not trying to run a business. He would like the machines to earn something, and he would like the awkwardness taken out of lending to people he has to live beside.

**What he needs:** low commitment. He is not "online." He accepts when it suits him.

**What he distrusts:** strangers taking his implement away. He will lend *with himself driving* long before he lends the machine alone.

**Design implication:** he must be able to list a machine as **"with operator only."** Bare rental is opt-in, never assumed. This is why bare rental is deferred past v1 — the trust it needs doesn't exist yet.

> *"Machine dena theek hai. Par main naal jaavanga."*

---

## 4. Ramesh Kumar — the migrant captain

**48, from Sri Ganganagar. Two combines, a crew of four, and a truck.**

Every rabi season he follows the ripening wave north — Rajasthan in late March, into Punjab through Fazilka in April, then further up. He works about 45 days and earns most of his annual income in them.

**His problem is the first two days in every new district.** He arrives where he knows nobody. He parks at a chowk, asks around, finds a commission agent, and loses a day and a half of a 45-day season. Multiply by four districts and he has lost a week of peak earnings.

**What he needs:** to arrive with work already booked. To be visible the moment he crosses into a district.

**What he distrusts:** being sent to a field that turns out to be too small, too wet, or unreachable by a 14-foot machine. A wasted trip in peak week is expensive.

**What he needs from the app that others don't:**
- Route declaration — "I'll be in Fazilka the 12th to the 18th" — so farmers pre-book
- Clustering, so his queue is geographically tight
- Field access details: can the truck reach it, is the approach hard
- No local reputation, so his ratings from other districts must travel with him

**He is the highest-value early user.** He has the most to gain, the most cash, and the least loyalty to incumbents. Onboarding migrant combine operators is the single highest-leverage acquisition activity in season one — and Fazilka, on the Rajasthan border, is where they enter Punjab.

> *"Do din barbaad ho jaande ne har zile vich. Ohi do din mera nuksaan ne."*

---

## Cross-cutting design constraints

Every persona above shares these. They are not accessibility extras — they are the product.

| Constraint | Consequence |
|---|---|
| Reads slowly, if at all | Icons and photographs carry meaning. Text supports, never leads. |
| Punjabi first | Gurmukhi default in Fazilka. Hindi around Abohar. English last. |
| Low-end Android | Small APK, low memory, no heavy animation. |
| Bad network in fields | Everything critical works offline and syncs. |
| Phone is the business line | A call button on every screen. The app never replaces the phone call — it makes the call worth making. |
| Cash economy | Digital payment is offered, never required. |
| Trust is local | Village name, photo of the actual machine, and a real rating count matter more than any badge. |
