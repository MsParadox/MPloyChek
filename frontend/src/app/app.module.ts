import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatToolbarModule }     from '@angular/material/toolbar';
import { MatIconModule }        from '@angular/material/icon';
import { MatButtonModule }      from '@angular/material/button';
import { MatMenuModule }        from '@angular/material/menu';
import { MatDividerModule }     from '@angular/material/divider';
import { MatSnackBarModule }    from '@angular/material/snack-bar';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule }     from '@angular/material/tooltip';
import { MatBadgeModule }       from '@angular/material/badge';
import { MatChipsModule }       from '@angular/material/chips';
import { MatListModule }        from '@angular/material/list';

import { AppComponent }              from './app.component';
import { AppRoutingModule }          from './app-routing.module';
import { JwtInterceptor }            from './core/interceptors/jwt.interceptor';
import { LoaderComponent }           from './shared/components/loader/loader.component';
import { NavbarComponent }           from './shared/components/navbar/navbar.component';
import { SessionWarningComponent }   from './shared/components/session-warning/session-warning.component';
import { GlobalSearchComponent }     from './shared/components/global-search/global-search.component';

@NgModule({
  declarations: [
    AppComponent,
    LoaderComponent,
    NavbarComponent,
    SessionWarningComponent,
    GlobalSearchComponent,
  ],
  imports: [
    BrowserModule, BrowserAnimationsModule, HttpClientModule,
    FormsModule, ReactiveFormsModule, AppRoutingModule,
    MatToolbarModule, MatIconModule, MatButtonModule, MatMenuModule,
    MatDividerModule, MatSnackBarModule, MatProgressBarModule,
    MatTooltipModule, MatBadgeModule, MatChipsModule, MatListModule,
  ],
  providers: [{ provide: HTTP_INTERCEPTORS, useClass: JwtInterceptor, multi: true }],
  exports: [LoaderComponent, NavbarComponent, GlobalSearchComponent],
  bootstrap: [AppComponent],
})
export class AppModule {}
