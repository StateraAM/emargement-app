import toast from 'react-hot-toast';

function getToastStyle(borderColor: string): React.CSSProperties {
  return {
    background: 'var(--color-surface-card)',
    color: 'var(--color-text)',
    border: `1px solid ${borderColor}`,
  };
}

export const showToast = {
  success: (message: string) => toast.success(message, {
    style: getToastStyle('var(--color-success-border)'),
    iconTheme: { primary: '#22c55e', secondary: '#fff' },
  }),
  error: (message: string) => toast.error(message, {
    style: getToastStyle('var(--color-danger-border)'),
    iconTheme: { primary: '#dc2626', secondary: '#fff' },
  }),
  info: (message: string) => toast(message, {
    icon: '\u2139\uFE0F',
    style: getToastStyle('var(--color-border)'),
  }),
};
