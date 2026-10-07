import Card from './Card';

export default function Surface({ as: Component = 'section', variant = 'default', className = '', children, ...props }) {
  return <Card as={Component} variant={variant} className={className} {...props}>{children}</Card>;
}
