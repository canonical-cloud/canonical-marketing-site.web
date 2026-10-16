# How C++26 becomes an ISO standard: WG21, ANSI, and the approval pipeline

*Canonical Plus Insights · 16 October 2026 · 9-minute read*

C++ features are not approved by a single person or a compiler vendor. They move through public proposals, expert review, committee consensus, changes to the working draft, and finally an international standards ballot. **Technical completion is not the same as publication.**

As of **16 October 2026**, WG21 had completed the C++26 technical feature set (March 2026), while ISO listed the next ISO/IEC 14882 edition as a **Draft International Standard (DIS), stage 40.20**, with a 12-week ballot begun on 31 July 2026. The published international standard is still **ISO/IEC 14882:2024 (C++23)**. Check the [live ISO record](https://www.iso.org/standard/91179.html) for any later transition.

## Who is who?

| Body | Role | What it does **not** do |
| --- | --- | --- |
| **ISO and IEC** | International standards organizations; C++ is ISO/IEC 14882 within JTC 1 → SC 22 → WG21. | ISO staff do not independently design all C++ language features. |
| **WG21** | International C++ standards working group and expert subgroups. | A WG21 plenary vote does not, by itself, publish an ISO standard. |
| **ANSI** | U.S. national member body of ISO; coordinates the U.S. consensus position. | ANSI is not a separate competing C++ language-design committee. |
| **INCITS/C++** | U.S. Technical Advisory Group (TAG) to WG21, formerly PL22.16. | U.S. consensus does not replace the votes of other participating ISO national bodies. |

**“ANSI C++”** is historically familiar shorthand. Today's globally maintained specification is the **ISO/IEC C++ standard**. An American National Standard designation or national adoption (when applicable) is a *separate status*; it is not a second C++26 design process.

## The proposal-to-working-draft pipeline

~~~mermaid
flowchart TD
    A["Idea, problem statement & prototype"] --> B["P-paper: motivation, design, impact & wording"]
    B --> C{"Study-group / incubator review needed?"}
    C -- Yes --> D["SG review, experiments & revision"]
    D --> E["Evolution: EWG (language) or LEWG (library)"]
    C -- No --> E
    E --> F{"Sufficient consensus?"}
    F -- "Revise / defer / reject" --> B
    F -- Yes --> G["Wording review: CWG or LWG"]
    G --> H{"Correct, implementable wording?"}
    H -- Rework --> B
    H -- Yes --> I["WG21 plenary motion / vote"]
    I --> J{"Adopted?"}
    J -- No --> B
    J -- Yes --> K["Integrated into ISO C++ working draft"]
~~~

Not every paper visits every group or follows the same sequence. Study groups and the Direction/ABI review bodies are advisory; evolution and wording groups assess the design and text; plenary adopts motions. A working draft can receive corrections and comment-resolution changes even after the feature set freezes.

## From committee draft to international standard

~~~mermaid
flowchart TD
    WD["WG21 working draft"] --> CD["ISO/IEC Committee Draft (CD): national review"]
    CD --> N{"National-body comments resolved?"}
    N -- No --> R["WG21 discussion, corrections, revised draft"]
    R --> CD
    N -- Yes --> DIS["Draft International Standard (DIS) ballot"]
    DIS --> P{"Applicable ISO/IEC approval criteria met?"}
    P -- No --> R
    P -- Yes --> F["Final approval / editorial path; FDIS if required"]
    F --> PUB["ISO/IEC 14882 published"]
    PUB --> I["Implementations, conformance, deployment"]
~~~

This is a simplified illustration, **not** a promise of automatic progression. The FDIS stage may be used or skipped depending on applicable ISO/IEC procedures. National bodies—not a public popularity poll—cast ISO ballots under the formal process.

## Where the U.S. fits

~~~mermaid
flowchart LR
    US["U.S. stakeholders & experts"] --> TAG["INCITS/C++ U.S. TAG"]
    TAG --> ANSI["ANSI: U.S. ISO member body"]
    ANSI --> BALLOT["ISO national-body position / ballot"]
    INT["Experts from other countries"] --> WG["WG21 technical work"]
    US --> WG
    WG --> ISO["ISO/IEC JTC 1 / SC 22 draft"]
    BALLOT --> ISO
    ISO --> PUB["International Standard ISO/IEC 14882"]
~~~

The U.S. TAG develops an American consensus position. ANSI represents the U.S. at ISO and transmits the national position. WG21 simultaneously develops technical content through international expert participation. The governance and technical paths connect but are **not identical approval votes**.

## C++26: what changed, and what remains?

The C++26 technical set includes **compile-time reflection**, **contracts** (preconditions, postconditions, assertions), **standard-library hardening**, and **<code>std::execution</code>**. Adoption by WG21 does not imply uniform implementation, ABI support, production readiness, or published ISO status. Check compiler feature support before enabling it in shipped software.

**Status on 16 October 2026:** technical work complete; **ISO/IEC DIS 14882 at 40.20**, not yet a published edition. The DIS ballot opened 31 July 2026 for 12 weeks. ISO's official status may change after this article's date.

## Insights for engineering teams

1. **Track the paper and revision, not only the feature name.** A P-number, revision, subgroup disposition, plenary motion, and resulting wording are different checkpoints.
2. **Expect revisions.** Consensus is a design filter; unfavorable votes or unresolved wording can return a proposal to an earlier stage.
3. **Distinguish de jure standardization from implementation.** A merged standard draft does not guarantee that GCC, Clang, or MSVC already implement it consistently.
4. **Watch operational risks.** Contracts, reflection, and concurrency features may change build tools, static analysis, testing strategies, compile-time costs, or migration plans.
5. **Avoid certification language.** ISO/IEC 14882 is a programming-language specification—not certification of an application, organization, or cloud service.

## Primary sources and further reading

- [ISO: C++26 draft status, ISO/IEC DIS 14882](https://www.iso.org/standard/91179.html)
- [ISO C++ working group WG21](https://www.open-std.org/jtc1/sc22/wg21/)
- [WG21 committee organization](https://isocpp.org/std/the-committee)
- [INCITS/C++ U.S. TAG](https://www.incits.org/committees/pl22.16)
- [ANSI's role in ISO and U.S. TAGs](https://ansi.org/iso/us-representation-in-iso/introduction)
- [ISO/IEC JTC 1/SC 22](https://www.iso.org/committee/45202.html)
- [Herb Sutter's March 2026 C++26 committee report](https://herbsutter.com/2026/03/29/c26-is-done-trip-report-march-2026-iso-c-standards-meeting-london-croydon-uk/)

*Editorial note: Descriptive analysis only. This article is not an official statement on behalf of ISO, IEC, ANSI, INCITS, or WG21. Standards status is date-sensitive.*