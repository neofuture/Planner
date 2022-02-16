import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class FileService {


  private setting = {
    element: {
      dynamicDownload: null as HTMLElement
    }
  };

  data(data) {
    return of(JSON.parse(data));
  }


  downloadJson(data, fileName) {
    this.data(data).subscribe((res) => {
      this.download({
        fileName,
        text: JSON.stringify(res)
      });
    });
  }

  private download(arg: {
    fileName: string,
    text: string
  }) {
    if (!this.setting.element.dynamicDownload) {
      this.setting.element.dynamicDownload = document.createElement('a');
    }
    const element = this.setting.element.dynamicDownload;
    const fileType = arg.fileName.indexOf('.json') > -1 ? 'text/json' : 'text/plain';
    element.setAttribute('href', `data:${fileType};charset=utf-8,${encodeURIComponent(arg.text)}`);
    element.setAttribute('download', arg.fileName);
    const event = new MouseEvent('click');
    element.dispatchEvent(event);
  }
}
