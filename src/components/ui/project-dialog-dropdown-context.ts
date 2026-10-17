"use client";

import { createContext } from "react";

export const ProjectDialogDropdownContext = createContext<(open: boolean) => void>(() => {});
