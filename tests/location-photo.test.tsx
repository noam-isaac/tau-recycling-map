import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LocationDetails } from "../src/components/LocationDetails";
import type { RecyclingCategory, RecyclingLocation } from "../src/data/types";

const category: RecyclingCategory = {
  id: "cardboard",
  label: { he: "קרטונייה", en: "Cardboard" },
  color: "#a76d3a",
  icon: "/icons/cardboard.svg",
};

const location: RecyclingLocation = {
  id: "cardboard-test",
  categoryId: category.id,
  descriptionHe: null,
  imageUrl: "/images/cardboard-bin-demo.webp",
  lat: 32.113,
  lng: 34.804,
};

afterEach(cleanup);

describe("location photo lightbox", () => {
  it("opens the full photo and closes from the backdrop, Escape, or close button", () => {
    render(
      <LocationDetails
        locale="en"
        location={location}
        category={category}
        nearestLocationId={null}
        relativePosition={null}
        deviceHeading={null}
        deviceHeadingStatus="idle"
        userLocation={null}
        geolocationStatus="idle"
        onClose={vi.fn()}
        onRequestLocation={vi.fn()}
      />,
    );

    const trigger = screen.getByRole("button", { name: "View full photo" });
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");

    fireEvent.click(trigger);
    let dialog = screen.getByRole("dialog", {
      name: "Enlarged recycling point photo",
    });
    const closeButton = screen.getByRole("button", { name: "Close full photo" });
    const images = screen.getAllByRole("img", {
      name: "Photo of the recycling point: Cardboard",
    });
    const fullPhoto = images[1];
    if (!fullPhoto) throw new Error("The enlarged photo did not render");

    expect(closeButton).toHaveFocus();
    expect(fullPhoto).toHaveAttribute("src", location.imageUrl);
    expect(fullPhoto).toHaveAttribute("referrerpolicy", "no-referrer");

    fireEvent.click(fullPhoto);
    expect(dialog).toBeInTheDocument();

    fireEvent.click(dialog);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();

    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();

    fireEvent.click(trigger);
    dialog = screen.getByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "Close full photo" }));
    expect(dialog).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
