// Achievement badges are derived entirely from a user's existing, auditable
// platform stats (verification status, completed projects, rating). They are
// never stored separately, so they can never drift out of sync with reality
// or be granted for anything other than real, verifiable activity.

export function computeBadges(user) {
  const badges = [];
  if (!user) return badges;

  const rating = parseFloat(user.rating) || 0;
  const totalReviews = parseInt(user.total_reviews, 10) || 0;
  const projectsCompleted = parseInt(user.total_projects_completed, 10) || 0;

  if (user.is_verified) {
    badges.push({
      key: 'verified',
      label: 'Verified',
      description: 'Identity and email verified'
    });
  }

  if (projectsCompleted >= 20) {
    badges.push({
      key: 'super-writer',
      label: 'Super Writer',
      description: '20+ completed projects'
    });
  } else if (projectsCompleted >= 5) {
    badges.push({
      key: 'experienced',
      label: 'Experienced Writer',
      description: '5+ completed projects'
    });
  } else if (projectsCompleted >= 1) {
    badges.push({
      key: 'rising-star',
      label: 'Rising Star',
      description: 'Completed their first project'
    });
  }

  if (rating >= 4.8 && totalReviews >= 5) {
    badges.push({
      key: 'top-rated',
      label: 'Top Rated',
      description: '4.8+ average rating across 5+ reviews'
    });
  }

  return badges;
}

export default computeBadges;
