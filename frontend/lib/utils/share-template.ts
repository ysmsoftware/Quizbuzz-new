export interface ShareTemplateValues {
  referralLink: string;
  ambassadorName: string;
  contestName: string;
}

/** Fills the {referralLink}/{ambassadorName}/{contestName} tokens a share-message template
 *  may contain (see ShareTemplatesEditor.tsx's SHARE_TEMPLATE_PLACEHOLDERS, the admin-facing
 *  editor where these are authored) with this ambassador's real values. The editor's own
 *  substitutePlaceholders() does the same swap but with sample data for its own preview —
 *  this is the ambassador-facing counterpart, used wherever a template is actually rendered
 *  for sharing (the campaign detail page's Ambassador Kit and Quick Share cards). */
export function fillShareTemplate(text: string, values: ShareTemplateValues): string {
  return Object.entries(values).reduce((acc, [key, val]) => acc.split(`{${key}}`).join(val), text);
}
