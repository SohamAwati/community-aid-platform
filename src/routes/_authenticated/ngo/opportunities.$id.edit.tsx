import { pageMeta } from "@/lib/page-meta";
import { createFileRoute } from "@tanstack/react-router";
import { OpportunityForm } from "./opportunities.new";

export const Route = createFileRoute("/_authenticated/ngo/opportunities/$id/edit")({
  head: () => ({ meta: pageMeta("Edit opportunity — Volunteer Connect", "Update your NGO’s opportunity details and application form.") }),
  component: EditOpp,
});

function EditOpp() {
  const { id } = Route.useParams();
  return <OpportunityForm editId={id} />;
}
