/**
 * DEMO MODE bar.
 *
 * Deliberately loud, deliberately unclosable, and pinned above everything.
 *
 * The reason is the whole point of this work: in demo mode the loan book is
 * 80,035 fabricated loans, some borrowers hold PCAF scores granted by a
 * hardcoded name list, and air-quality readings are generated from
 * coordinates. All of it renders exactly like real data, because it is
 * supposed to look convincing in front of a bank.
 *
 * Which means a screenshot of this app is indistinguishable from a real
 * disclosure unless something on screen says otherwise. A dismissible notice
 * would be dismissed and then forgotten; a subtle one would be cropped out.
 * So it stays, it is bright, and it is at the top where it lands in any
 * screen capture.
 *
 * Not rendered at all in a live build -- there is no demo layer to warn
 * about, and a warning that never applies teaches people to ignore warnings.
 */

export function DemoModeBanner() {
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-3 bg-amber-500 px-4 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wider text-amber-950"
    >
      <span aria-hidden>▲</span>
      <span>
        Demo mode · portfolio and screening data are synthetic, not a real
        loan book
      </span>
      <span aria-hidden>▲</span>
    </div>
  );
}
