// Returns true when the create-route page should render the Natural Language
// AIImportWizard branch instead of the manual form. Centralized so it can be
// unit-tested without mounting the heavy parent page.
export function shouldRenderNLWizard(mode: string | null): boolean {
  return mode === 'nl';
}
