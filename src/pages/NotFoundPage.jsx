import { Link } from 'react-router-dom';
import EmptyState from '../components/common/EmptyState';

export default function NotFoundPage() {
  return (
    <EmptyState
      title="Page not found"
      message="The requested page is not available."
      action={<Link to="/issues" className="rounded-md bg-blue-700 px-3 py-2 text-sm font-semibold text-white">Open Issues</Link>}
    />
  );
}
