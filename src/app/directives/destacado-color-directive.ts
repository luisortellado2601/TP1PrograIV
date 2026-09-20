import { Directive, ElementRef, Input, OnChanges, Renderer2 } from '@angular/core';

@Directive({
  selector: '[appDestacadoColor]',
  standalone: true
})
export class DestacadoColorDirective implements OnChanges {
  @Input() appDestacadoColor: boolean = false;

  constructor(private el: ElementRef, private renderer: Renderer2) {}

  ngOnChanges() {
    if (this.appDestacadoColor) {
      this.renderer.setStyle(this.el.nativeElement, 'color', '#ef4444');
      this.renderer.setStyle(this.el.nativeElement, 'textShadow', '0 0 8px rgba(239, 68, 68, 0.4)');
    } else {
      this.renderer.setStyle(this.el.nativeElement, 'color', '#ffffff');
      this.renderer.setStyle(this.el.nativeElement, 'textShadow', 'none');
    }
  }
}