import LordAuth from "@/components/auth/lord-auth";

export default async function LoginPage({searchParams}:{searchParams:Promise<{reason?:string|string[]}>}) {
  const {reason}=await searchParams;
  const message=reason==="expired"?"انتهت جلستك. سجّل الدخول للمتابعة.":null;
  return <>
    {message&&<p role="status" dir="rtl" className="fixed inset-x-4 top-4 z-50 mx-auto w-fit rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-sm text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">{message}</p>}
    <LordAuth mode="login" />
  </>;
}
