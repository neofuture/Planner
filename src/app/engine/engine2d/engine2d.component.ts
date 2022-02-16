import {AfterViewInit, Component, ElementRef, EventEmitter, HostListener, Input, OnInit, Output, ViewChild} from '@angular/core';
import {Engine2dService} from './engine2d.service';
import {Subscription} from 'rxjs';

@Component({
  selector: 'app-engine2d',
  templateUrl: './engine2d.component.html',
  styleUrls: ['./engine2d.component.css']
})
export class Engine2dComponent implements OnInit {

  @Input() roomShape;
  @ViewChild('canvasGrid', {read: ElementRef, static: false}) canvasGrid: ElementRef;
  @ViewChild('canvas', {read: ElementRef, static: false}) canvas: ElementRef;
  @ViewChild('canvasTools', {read: ElementRef, static: false}) canvasTools: ElementRef;
  @ViewChild('canvasTiles', {read: ElementRef, static: false}) canvasTiles: ElementRef;
  @ViewChild('canvasInsets', {read: ElementRef, static: false}) canvasInsets: ElementRef;
  @ViewChild('canvasControls', {read: ElementRef, static: false}) canvasControls: ElementRef;
  @Output() zoomLevel: EventEmitter<any> = new EventEmitter();

  private subscription: Subscription;

  constructor(
    private engineService: Engine2dService
  ) {
  }

  @HostListener('window:resize', ['$event'])
  onResize(event) {
    this.engineService.resize();
  }

  ngOnInit() {
    this.subscription = this.engineService.zoomLevelChanged$
      .subscribe(zoomLevel => {
        this.zoomLevel.emit(zoomLevel);
      });

    setTimeout(() => {
      this.engineService.startEngine(
        this.canvasGrid.nativeElement,
        this.canvas.nativeElement,
        this.canvasInsets.nativeElement,
        this.canvasTools.nativeElement,
        this.canvasControls.nativeElement,
        this.canvasTiles.nativeElement,
        this.roomShape
      );
    }, 200);
  }

  onPinchStart(event: any) {
    this.engineService.onPinchStart(event);
  }

  onPinchEnd(event: any) {
    this.engineService.onPinchEnd(event);

  }

  onPinch(event: any) {
    this.engineService.onPinch(event);
    console.log(event);
  }
}
