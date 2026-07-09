---
name: etsy-review-responder
description: Drafts on-brand, specific reply text for shop reviews — prioritizing low-star and substantive reviews first, since those are the ones that hurt most and are easiest to let slip. Trigger this whenever the user says "help me respond to my reviews", "draft a reply to this review", "write a response to my 3-star review", "help me handle a negative review", "someone left a bad review, what do I say", "reply to my recent reviews", or any request to compose, word, or soften a response to buyer feedback. Also trigger when a review analysis surfaces a review the user clearly wants to answer. Reach for this on any "how should I reply" review intent even if the user doesn't name the skill.
---

# Etsy Review Responder

## Read this first — there is no API to post replies

Etsy's public API has **no "reply to review" endpoint**. This MCP server cannot publish a review reply anywhere. Everything this skill produces is **draft text the user must manually copy-paste into Etsy's own seller dashboard** to actually post it. Say this plainly to the user up front so they never expect it to go live automatically. The one thing that *can* be sent programmatically is a direct email to the buyer (via `draft_email` / `send_email`) — and only if the buyer emailed in and their contact info is available. Public review replies are always manual.

## Which reviews to pull

Call `get_shop_reviews` to pull the review set. Unless the user pointed at one specific review, **prioritize the ones that matter**: sort so that low-star (≤3) and long/substantive reviews come first. A cheerful five-star "love it!" barely needs a reply; a detailed one-star is the one that shapes how future buyers perceive the shop, and it's the one most likely to have been missed. If the user names a single listing, use `get_reviews_by_listing` for that listing_id. If you need product context to write a specific reply (what the item actually is), pull `get_listing_details` or `get_listings_by_ids` (batch — respect the 5 req/s, 5,000/day budget).

## How to write a reply that isn't generic

The whole point is specificity. A templated "Thank you for your feedback!" reads as a brush-off and does nothing. Every draft must acknowledge the *specific thing this buyer actually said*.

**For positive reviews:** name what they praised, echo it warmly, and where natural invite them back. Keep it human, short, and un-corporate.

**For negative reviews:**
- Acknowledge the specific issue by name (the late shipment, the file that wouldn't open, the size that ran small).
- **Do not be defensive.** No excuses, no "well actually," no blaming the buyer or the carrier. Future buyers read these — a defensive seller looks worse than a flawed product.
- Lead with genuine ownership and empathy.
- Where a concrete fix or make-good is appropriate, offer it — **but only if the user has confirmed they actually want to offer it.** Never invent shop policy, refunds, replacements, or discounts on the user's behalf. If an offer would help, flag it as an option and ask the user before writing it into the draft.

**For neutral / mixed reviews:** thank them for the balanced feedback, address the specific ding, and briefly note any relevant improvement.

Match the shop's voice. If prior replies or listing copy establish a tone, mirror it. Default to warm, plainspoken, and concise.

## Output

For each review you draft a reply to, present a block in this exact shape:

### Review [n] — [star rating] on [listing title, if known]
- **Original review:** the buyer's verbatim text (and reviewer first name/initial if shown).
- **Drafted reply:** the ready-to-paste response text.
- **Tone rationale:** one line on why this reply is worded the way it is (e.g. "acknowledges the corrupt-file issue directly and offers re-send, per your go-ahead — no defensiveness so future buyers see accountability").

After all the blocks, close with:

1. **A manual-paste reminder:** these must be copied into Etsy's seller dashboard by hand — there is no API to post them.
2. **An optional email-follow-up offer:** if a negative review's buyer also emailed the shop and the situation warrants more personal outreach than a public reply, offer to draft a direct follow-up email. Search with `search_emails` and read with `read_email` to find their message, then use `draft_email` to compose it. A draft only saves — it does not send — so it needs no confirmation, but **always show the drafted email content to the user afterward** so they can review before sending it themselves from Gmail. If the user wants it actually sent via `send_email`, that is a send action: **show the full draft and get an explicit "yes/haan/confirm" before calling `send_email`.**
