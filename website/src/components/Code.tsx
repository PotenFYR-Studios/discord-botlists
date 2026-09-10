import type { ReactNode } from 'react';

export default function Code({ children }: { children: ReactNode }) {
  return (
    <div className="code-block mt-4 whitespace-pre">{children}</div>
  );
}
