import { toStored } from './rating';

export function buildGalleryParams(filters, allTags) {
  const tagNames = (filters.tags || [])
    .map(id => allTags.find(t => t.id === id)?.name)
    .filter(Boolean);
  return {
    search: filters.search || undefined,
    source: filters.source || undefined,
    media_type: filters.mediaType || undefined,
    is_edited: filters.isEdited || undefined,
    is_reference: filters.isReference || undefined,
    campaign_id: filters.campaignId || undefined,
    aspect_ratio: filters.aspectRatio || undefined,
    generated_by: (filters.generatedBy || []).length ? filters.generatedBy.join(',') : undefined,
    // The filter inputs are in half stars (0.5-5); the API filters on the
    // stored 1-10 scale.
    rating_min: filters.ratingMin ? toStored(filters.ratingMin) : undefined,
    rating_max: filters.ratingMax ? toStored(filters.ratingMax) : undefined,
    date_from: filters.dateFrom || undefined,
    date_to: filters.dateTo || undefined,
    tags: tagNames.length ? tagNames.join(',') : undefined,
    ordering: filters.sort || undefined,
  };
}
