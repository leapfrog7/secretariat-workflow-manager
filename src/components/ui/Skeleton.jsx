import { cx } from './utils';

export default function Skeleton({ as: Component = 'span', className = '', ...props }) {
  return <Component className={cx('loading-shimmer block rounded-[var(--swm-radius-md)] bg-[var(--swm-surface-muted)]', className)} aria-hidden="true" {...props} />;
}
