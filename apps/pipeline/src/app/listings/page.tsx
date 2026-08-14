import { getDb, ready } from "@/lib/db";
import { listListings } from "@/lib/listings";

export const dynamic = "force-dynamic";

export default async function ListingsPage() {
  const db = getDb();
  await ready();
  const listings = await listListings(db);

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-foreground">Listings</h1>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm text-foreground">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="p-2">Address</th>
              <th className="p-2">Area</th>
              <th className="p-2">Type</th>
              <th className="p-2">Price</th>
              <th className="p-2">Status</th>
              <th className="p-2">Days on Market</th>
            </tr>
          </thead>
          <tbody>
            {listings.map((l) => (
              <tr key={l.id} className="border-b border-border/60">
                <td className="p-2">{l.address}</td>
                <td className="p-2">{l.area}</td>
                <td className="p-2">{l.type}</td>
                <td className="p-2">{l.price.toLocaleString()}</td>
                <td className="p-2">{l.status}</td>
                <td className="p-2">{l.days_on_market}</td>
              </tr>
            ))}
            {listings.length === 0 && (
              <tr>
                <td className="p-2 text-muted-foreground" colSpan={6}>
                  No listings yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
