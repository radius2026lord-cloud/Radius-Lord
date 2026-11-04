"use client";
import {useParams} from "next/navigation";
import MasterNetworks from "@/components/master-networks";
export default function NetworkDetailsPage(){
 const {id}=useParams<{id:string}>();
 return <MasterNetworks networkId={Number(id)}/>;
}
