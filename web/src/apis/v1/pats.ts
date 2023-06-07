// @ts-ignore
/* eslint-disable */
///////////////////////////////////////////////////////////////////////
//                                                                   //
// this file is autogenerated by service-generate                    //
// do not edit this file manually                                    //
//                                                                   //
///////////////////////////////////////////////////////////////////////
/// <reference path = "api-auto.d.ts" />
import request from "@/utils/request";
import useGlobalStore from "@/pages/globalStore";

/**
 * Create a PAT
 */
export async function PatControllerCreate(params: Definitions.CreatePATDto): Promise<{
  error: string;
  data: Paths.PatControllerCreate.Responses;
}> {
  // /v1/pats
  let _params: { [key: string]: any } = {
    appid: useGlobalStore.getState().currentApp?.appid || "",
    ...params,
  };
  return request(`/v1/pats`, {
    method: "POST",
    data: params,
  });
}

/**
 * List PATs
 */
export async function PatControllerFindAll(
  params: Paths.PatControllerFindAll.BodyParameters,
): Promise<{
  error: string;
  data: Paths.PatControllerFindAll.Responses;
}> {
  // /v1/pats
  let _params: { [key: string]: any } = {
    appid: useGlobalStore.getState().currentApp?.appid || "",
    ...params,
  };
  return request(`/v1/pats`, {
    method: "GET",
    params: params,
  });
}

/**
 * Delete a PAT
 */
export async function PatControllerRemove(
  params: Paths.PatControllerRemove.BodyParameters,
): Promise<{
  error: string;
  data: Paths.PatControllerRemove.Responses;
}> {
  // /v1/pats/{id}
  let _params: { [key: string]: any } = {
    appid: useGlobalStore.getState().currentApp?.appid || "",
    ...params,
  };
  return request(`/v1/pats/${_params.id}`, {
    method: "DELETE",
    data: params,
  });
}
