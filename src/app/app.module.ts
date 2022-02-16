import {NgModule} from '@angular/core';
import {BrowserModule, HammerModule} from '@angular/platform-browser';
import {AppComponent} from './app.component';
import {EngineComponent} from './engine/engine.component';
import {Engine2dComponent} from './engine/engine2d/engine2d.component';
import {Engine3dComponent} from './engine/engine3d/engine3d.component';
import {FormsModule} from '@angular/forms';
import {ButtonModule, CheckboxModule, DropdownModule, SliderModule, SpinnerModule} from 'primeng';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import { HeadingsPipe } from './pipes/headings.pipe';
import { ServiceWorkerModule } from '@angular/service-worker';
import { environment } from '../environments/environment';
import {HttpClientModule} from '@angular/common/http';

@NgModule({
  declarations: [
    AppComponent,
    EngineComponent,
    Engine2dComponent,
    Engine3dComponent,
    HeadingsPipe
  ],
  imports: [
    BrowserModule,
    FormsModule,
    CheckboxModule,
    DropdownModule,
    BrowserAnimationsModule,
    ButtonModule,
    SliderModule,
    HammerModule,
    ServiceWorkerModule.register('ngsw-worker.js', {enabled: environment.production}),
    SpinnerModule,
    HttpClientModule
  ],
  providers: [],
  bootstrap: [
    AppComponent
  ]
})
export class AppModule {
}
