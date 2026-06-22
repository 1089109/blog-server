import { uploadFilePrefix } from './config';
import type { MyFileType } from '../types/global';

const dateDir = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const getFilePath = (type: MyFileType, fileName: string): string => {
  const dir = dateDir();
  const map: Record<MyFileType, string> = {
    face: `/faces/${fileName}`,
    banner: `/banners/${dir}/${fileName}`,
    image: `/images/${dir}/${fileName}`,
    system: `/system/${dir}/${fileName}`,
    temp: `/temp_file/${dir}/${fileName}`,
    video: `/videos/${dir}/${fileName}`,
  };
  return map[type] || '/temp_file/';
};

export const setFilePath = (type: MyFileType): string => {
  const dir = dateDir();
  const map: Record<MyFileType, string> = {
    face: `${uploadFilePrefix}/faces/`,
    banner: `${uploadFilePrefix}/banners/${dir}/`,
    image: `${uploadFilePrefix}/images/${dir}/`,
    system: `${uploadFilePrefix}/system/${dir}/`,
    temp: `${uploadFilePrefix}/temp_file/${dir}/`,
    video: `${uploadFilePrefix}/videos/${dir}/`,
  };
  return map[type] || '/temp_file/';
};
