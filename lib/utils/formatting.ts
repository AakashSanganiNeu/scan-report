export const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

export const formatDate = (dateString: string): string => {
  const date = new Date(`${dateString}T00:00:00`);
  return new Intl.DateTimeFormat('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
};

export const formatDateTime = (isoDateTime: string): string =>
  new Intl.DateTimeFormat('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(isoDateTime));

export const toInputDateFormat = (date: Date): string =>
  date.toISOString().split('T')[0];

export const getCurrentMonthYear = (): { year: number; month: number } => {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
};

export const getMonthLabel = (year: number, month: number): string =>
  new Intl.DateTimeFormat('en-IN', {
    year: 'numeric',
    month: 'long',
  }).format(new Date(year, month - 1));
