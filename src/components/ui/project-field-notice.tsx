import type { ReactNode } from "react";

type ProjectFieldNoticeProps = {
  id?: string;
  children: ReactNode;
};

export default function ProjectFieldNotice({ id, children }: ProjectFieldNoticeProps) {
  return (
    <span
      id={id}
      role="alert"
      className="block text-[10px] font-medium text-amber-700 dark:text-amber-300"
    >
      {children}
    </span>
  );
}
