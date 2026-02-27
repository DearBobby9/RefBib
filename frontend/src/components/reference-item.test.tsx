import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ReferenceItem } from "@/components/reference-item";
import { Reference } from "@/lib/types";

function makeUnmatchedReference(): Reference {
  return {
    index: 1,
    raw_citation: "Sample raw citation",
    title: "Sample unmatched title",
    authors: ["Doe, J."],
    year: 2023,
    doi: null,
    venue: null,
    bibtex: "@misc{sample, title={Sample unmatched title}}",
    citation_key: "sample",
    match_status: "unmatched",
    match_source: "grobid_fallback",
    url: null,
  };
}

describe("ReferenceItem", () => {
  it("shows discovery error details when availability check fails", async () => {
    const user = userEvent.setup();
    const onCheckAvailability = vi
      .fn()
      .mockRejectedValue(new Error("upstream timeout"));

    render(
      <ReferenceItem
        reference={makeUnmatchedReference()}
        selected={false}
        onToggle={vi.fn()}
        onCheckAvailability={onCheckAvailability}
      />
    );

    await user.click(
      screen.getByRole("button", { name: /check availability/i })
    );

    expect(onCheckAvailability).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("upstream timeout")).toBeInTheDocument();
  });
});
