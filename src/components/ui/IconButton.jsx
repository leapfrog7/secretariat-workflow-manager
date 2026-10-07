import Button from './Button';

export default function IconButton({ label, size = 'icon', children, ...props }) {
  return (
    <Button size={size} aria-label={label} title={props.title || label} {...props}>
      {children}
    </Button>
  );
}
