"use client";
import ProjectDialog from "@/components/ui/project-dialog";

export default function EntityEditDialog({title,description,onClose,children,footer,maxWidth="max-w-2xl"}:{title:string;description?:string;onClose:()=>void;children:React.ReactNode;footer?:React.ReactNode;maxWidth?:string}){
 return <ProjectDialog title={title} description={description} onClose={onClose} footer={footer} maxWidth={maxWidth}>{children}</ProjectDialog>;
}
