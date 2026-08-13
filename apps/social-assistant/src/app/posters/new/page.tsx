import { listListingsForPoster } from '@/lib/data/properties';
import { listDeveloperProfiles } from '@/lib/data/developers';
import { getViewerRole } from '@/lib/auth/viewer-role';
import { canCreatePosters } from '@/types/social';
import { PosterForm } from './poster-form';

export const revalidate = 0;

export default async function NewPosterPage() {
  const role = await getViewerRole();

  if (!canCreatePosters(role)) {
    return (
      <div className="rounded-lg border border-brand-hairline bg-brand-bg-alt p-6">
        <h1 className="mb-2 text-lg font-semibold">Poster creation is founder-only for now</h1>
        <p className="text-sm text-brand-body/70">
          Per SPEC.md&apos;s RBAC table, poster creation is restricted to the founder (Owner/COO) until junior/
          marketing staff are onboarded (config change, no code change, when that happens). Switch &quot;Viewing
          as&quot; to <strong>Owner / COO</strong> in the nav to try this flow.
        </p>
      </div>
    );
  }

  const [listings, developerProfiles] = await Promise.all([listListingsForPoster(), listDeveloperProfiles()]);

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold tracking-wide text-brand-body">New poster</h1>
      <p className="mb-6 text-sm text-brand-body/60">
        Pick a listing (optional) and generate a brand-templated poster. Output is a draft SVG — nothing here calls
        an image-generation AI or publishes anywhere (see BRAND-KIT.md poster generation rules).
      </p>
      <PosterForm listings={listings} developerProfiles={developerProfiles} />
    </div>
  );
}
