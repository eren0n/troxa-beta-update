export function buildGalleryParams(filters, allTags) {
  const tagNames = (filters.tags || [])
    .map(id => allTags.find(t => t.id === id)?.name)
    .filter(Boolean);
  return {
    search: filters.search || undefined,
    source: filters.source || undefined,
    media_type: filters.mediaType || undefined,
    is_edited: filters.isEdited || undefined,
    campaign_id: filters.campaignId || undefined,
    aspect_ratio: filters.aspectRatio || undefined,
    generated_by: (filters.generatedBy || []).length ? filters.generatedBy.join(',') : undefined,
    rating_min: filters.ratingMin || undefined,
    rating_max: filters.ratingMax || undefined,
    date_from: filters.dateFrom || undefined,
    date_to: filters.dateTo || undefined,
    tags: tagNames.length ? tagNames.join(',') : undefined,
    ordering: filters.sort || undefined,
  };
}
