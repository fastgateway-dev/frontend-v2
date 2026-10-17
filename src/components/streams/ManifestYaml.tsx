// Read-only YAML block: the exact <pre> the domain Manifests tab uses
// (domains/[domainId]/page.tsx), shared by the stream and L4 route pages.
export function ManifestYaml({ yaml }: { yaml: string }) {
  return <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">{yaml}</pre>;
}
